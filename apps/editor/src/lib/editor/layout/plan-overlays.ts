import type { LayoutRoom, LayoutVec2 } from '$lib/layout/layout-types';
import {
	dedupeWallSpans,
	LAYOUT_PLAN_SNAP_RADIUS_CSS_PX,
	pointStrictlyInsidePolygon
} from '@portfolio/layout-core';
import type { LayoutPreviewModel } from './layout-mesh-factory';
import {
	primitiveDraftFootprint,
	rectanglePoints,
	wallChainRoleForTool,
	type LayoutArchitectureEditGesture,
	type LayoutInteractionState,
	type LayoutSelection
} from './layout-interaction';
import { planScreenToWorld, worldToPlanScreen, type PlanViewportState } from './layout-plan-transform';
import { geometryId } from '$lib/layout/layout-geometry-types';
import { layoutArchitecturalPreset } from '$lib/layout/layout-wall-first-precision';
import { isLayoutPresetTool, type LayoutPresetTool } from './layout-interaction';
import type {
	LayoutArchitecturalPresetId,
	SnapFeatureKind,
	SnapResolution
} from '@portfolio/layout-core';
import { compiledPhysicalWallLength, type PlanCurveControlCandidate } from './plan-hit';
import { PLAN_CONTROL_MARKS, type PlanFocusGeometry } from './plan-acquisition';
import { PLAN_SNAP_EXACT_VALUE_LABEL, planSnapGlyph, planSnapRelationLabelExtentPx } from './plan-snap-grammar';
import {
	PLAN_DIMENSION_LANES_PX,
	derivePlanDimensions,
	placePlanDimensions,
	planDimensionGestureKey,
	planDimensionText,
	planSidesWithRoom,
	type PlanDimensionFacts,
	type PlanDimensionMemory
} from './plan-dimensions';
import {
	PLAN_ARCHITECTURE_CONTROLS_MIN_PX_PER_M,
	PLAN_ROOM_LABELS_MIN_PX_PER_M
} from './plan-salience';
import {
	APPROXIMATE_TEXT_MEASURE,
	placeRoomLabels,
	roomFloorAreaM2,
	ROOM_LABEL_ACQUISITION_RESERVE_PX,
	ROOM_LABEL_ACTIVE_TEXT_RESERVE_PX,
	ROOM_LABEL_CORE_GEOMETRY_RESERVE_PX,
	type RoomLabelAcquisitionZone,
	type RoomLabelActiveText,
	type RoomLabelFacts,
	type RoomLabelMask,
	type RoomLabelMemory,
	type RoomLabelObstacle,
	type RoomLabelProtectedEdge,
	type RoomLabelReadout,
	type RoomLabelReconsiderReason,
	type RoomLabelTierDropZone,
	type TextMeasure
} from './plan-room-labels';
import { resolvePlanClosureCue } from './plan-preview';
import type {
	PlanHitIdentity,
	PlanInteractionProjection,
	PlanRenderPrimitive,
	PlanSelection,
	PlanStyleToken
} from '$lib/layout/plan-render-model';

// The P23.6 interior-anchor helper now lives in the S3 label module (it is the
// candidate-ranking semantic center, no longer a placement anchor); re-exported
// here so existing consumers keep one import site.
export { interiorLabelPoint } from './plan-room-labels';

/**
 * Transient interaction overlays, derived editor-side into world-space
 * `PlanRenderPrimitive` records. Screen-constant sizing/offsets are carried as
 * px hints (`radiusPx`/`offsetPx`) for the SVG adapter to apply after the view
 * transform. No Svelte/DOM imports; the viewport forwards interaction state
 * into this projection instead of computing overlay screen coordinates.
 */

/** Label offset from the winner mark, so the word never sits on the relation. */
const SNAP_RELATION_LABEL_OFFSET_PX = 10;
/** The word keeps this much clear of the canvas edge before it flips side. */
export const SNAP_RELATION_LABEL_INSET_PX = 4;

/**
 * P23.13 S5 — where the winner's relation word goes, given the canvas it is on.
 *
 * The word is anchored to the live pointer, so the preferred placement is up and
 * to the right of the mark; near an edge that placement clips, and a half-drawn
 * relation word is worse than no word at all. The side is therefore chosen from
 * the only data that can answer it — the caller's viewport — and the *extent* is
 * the glyph table's own typography. Stateless by construction: the winner is
 * recomputed every pointer event, so there is nothing to freeze, and a pointer
 * near an edge simply reads the other way round.
 *
 * Without a view (a pure caller, a unit test) the preferred side is returned, so
 * this adds a placement rule rather than a requirement on callers.
 *
 * The room on each side comes from `planSidesWithRoom`, the same measurement
 * §7's frozen dimension lane reads, so no two side policies in the Plan can
 * disagree about how much space a side actually has. What differs is the policy:
 * a lane is *offset* to the roomier side and frozen for the gesture, while this
 * pointer-anchored word reads the roomier side per event, because the winner is
 * recomputed on every pointer move and there is nothing to hold.
 */
export function planSnapRelationLabelOffsetPx(
	text: string,
	point: LayoutVec2,
	view: PlanViewportState | undefined
): readonly [number, number] {
	const preferred: readonly [number, number] = [
		SNAP_RELATION_LABEL_OFFSET_PX,
		-SNAP_RELATION_LABEL_OFFSET_PX
	];
	if (!view) return preferred;
	const [screenX, screenY] = worldToPlanScreen(view, point);
	const extent = planSnapRelationLabelExtentPx(text);
	const inset = SNAP_RELATION_LABEL_INSET_PX;
	const room = planSidesWithRoom(
		{
			minX: screenX,
			maxX: screenX + extent.width,
			minY: screenY - extent.height,
			maxY: screenY
		},
		view
	);
	// How much a placement would overrun the canvas on that side: positive means
	// the word's own box still has that much clear. The preferred side keeps the
	// word while it fits; otherwise the roomier side takes it, so a winner in a
	// corner lands on the side with space instead of on the other clipped one.
	const needed = (span: number) => SNAP_RELATION_LABEL_OFFSET_PX + span;
	const aboveSlack = room.abovePx - needed(extent.height);
	const belowSlack = room.belowPx - needed(extent.height);
	const rightSlack = room.rightPx - needed(extent.width);
	const leftSlack = room.leftPx - needed(extent.width);
	const above = aboveSlack >= inset || aboveSlack >= belowSlack;
	const toTheRight = rightSlack >= inset || rightSlack >= leftSlack;
	return [
		toTheRight ? preferred[0] : -SNAP_RELATION_LABEL_OFFSET_PX - extent.width,
		above ? preferred[1] : SNAP_RELATION_LABEL_OFFSET_PX + extent.height
	];
}
/**
 * P23.13 S4 / §6 — the Opening slide grip: two bars perpendicular to the host,
 * 9 px long, centred 4 px either side of the symbol center. Screen-constant
 * marks, so they never scale with zoom or Wall thickness.
 */
const OPENING_SLIDE_GRIP_HALF_LENGTH_PX = 4.5;
const OPENING_SLIDE_GRIP_OFFSET_PX = 4;
/**
 * P23.13 S4 / §6 focus ring geometry. `CLEARANCE_FACTOR` is just above √2, so the
 * innermost ring clears the circumscribed corner of a square/diamond mark as
 * well as the edge of a circle; `GAP` is the paper gap that makes the two rings
 * read as two instead of one thick ring.
 */
const FOCUS_RING_CLEARANCE_FACTOR = 1.45;
const FOCUS_RING_OFFSET_PX = 1;
const FOCUS_RING_GAP_PX = 2.5;
/**
 * P23.13 S6 — spec §7's ratified copy for a candidate that closes on the run
 * start ("otherwise say `Close at junction`"). S8 owns gating the closure cue
 * on canonical face evidence; S6 owns not printing a length under its name.
 */
export const PLAN_CLOSE_AT_JUNCTION_COPY = 'Close at junction';

/** Octagonal stop mark diameter of a refused proposal (spec §6). */
const REFUSAL_STOP_RADIUS_PX = 7;
const ROTATION_HANDLE_OFFSET_PX = 28;
const ROTATION_FEEDBACK_OFFSET_PX = 40;
const DIMENSION_LABEL_OFFSET_PX = 5;

/**
 * P23.13 S3 — the presentation-only inputs the Room label placer needs from the
 * viewport: resolved identity + derived area per compiled `roomId`, the text
 * measurement seam (real browser metrics in production), the sticky placement
 * memo and the reconsideration/settle signals.
 */	export type PlanRoomLabelContext = {
	facts: ReadonlyMap<
		string,
		{ name: string | null; reference: string | null; areaM2: number | null }
	>;
	/** Omitted in pure tests: placement then uses deterministic stand-in metrics. */
	measure?: TextMeasure;
	/** Memo of accepted candidates/hysteresis. Never document state. */
	memory?: RoomLabelMemory;
	reason?: RoomLabelReconsiderReason;
	settleGeneration?: number;
	/**
	 * P23.13 S8 / §1.12 — the live instrument zone, when one is being worked: a
	 * label whose accepted anchor falls inside it drops to its tier ceiling
	 * (area → reference, pair-safe). Region-scoped by construction, so nothing
	 * outside the zone changes its tier.
	 */
	tierDropZone?: RoomLabelTierDropZone;
};

/**
 * P23.13 S6 — the dimension instrument's state (spec §7). §7 freezes the lane
 * side at gesture start, so the freeze has to outlive a frame; it is passed in
 * exactly like the Room label memo rather than held as module state, and
 * omitting it simply means each frame decides its own side (what a pure test
 * wants).
 */
export type PlanDimensionContext = {
	memory?: PlanDimensionMemory;
};

/**
 * P23.6 — wall-first Plan context for presentation-only projections. Every
 * field derives from the live document/preview; nothing here is authored
 * truth and nothing is persisted.
 */
export type PlanWallFirstContext = {
	/** Canonical Junctions for edit-context handles. */
	junctions: readonly { id: string; point: LayoutVec2 }[];
	/**
	 * P23.11 — the transient curve controls of the selected curved Wall, or an
	 * empty list. Only a selected curved Wall exposes them, so this is editing
	 * state rather than document truth: the same list the *hit* query receives,
	 * which keeps one authority for what is hoverable and what is drawn.
	 */
	curveControls: readonly PlanCurveControlCandidate[];
	/**
	 * Junctions to show when a Wall is selected (`null` = all). The viewport
	 * focuses the selected Wall's endpoints so selection context stays quiet.
	 */
	junctionFocus: ReadonlySet<string> | null;
	/** Room display names by compiled `roomId` (presentation of Room metadata). */
	roomNames: ReadonlyMap<string, string>;
	/**
	 * P23.13 S3 — Room label inputs beyond the name: the resolved display
	 * identity pair (name → reference → raw-ID label) and the derived area, plus
	 * the text-measurement seam and the sticky placement memo. All presentation:
	 * the document, the compile result and history are never written.
	 */
	roomLabels?: PlanRoomLabelContext;
	/** P23.13 S6 — dimension instrumentation state (the §7 lane freeze). */
	dimensions?: PlanDimensionContext;
	/**
	 * P23.13 S4 / §6 — the focused Plan control and its owner's control
	 * geometry. Focus is presentation/routing state only; it never touches
	 * selection, geometry or history. `geometry` is resolved by
	 * `plan-acquisition.planFocusGeometry` from canonical compiled samples, so a
	 * curve keeps its curve and the overlay never invents a centerline.
	 */
	focus?: {
		/** World center of the focused control's visible mark. */
		point: LayoutVec2;
		/** Mark radius in CSS px (the ring sits outside it). */
		radiusPx: number;
		/** Owner control net (1 px broken polygon) + true reference centerline. */
		geometry: PlanFocusGeometry | null;
	} | null;
	/** Resolved run-start Junction point for the closure cue (`null` when none). */
	runStartPoint: LayoutVec2 | null;
	/**
	 * P23.13 S8 / §7 — the canonical face evidence for the live run's closure,
	 * produced by the viewport (the only layer holding the baseline document)
	 * through `wallChainClosureEvidence`: it plans the closing leg exactly as the
	 * click would and hands back the face that plan creates.
	 *
	 * Evidence only — the *decision* stays here, where the run's own closing rule
	 * already lives, so the cue's condition and its evidence cannot be answered by
	 * two different readings of "the candidate is closing". Empty/absent means no
	 * canonically proved face, which is the ordinary case for most frames.
	 */
	closureFaces?: readonly (readonly LayoutVec2[])[];
	/** Committed compiler issues with positioned targets for diagnostic markers. */
	issues: readonly { code: string; message: string; targetId?: string; path?: string }[];
};

/**
 * P23.6/P23.13 S5 — snap marker radius per winning family (screen-constant,
 * zoom-stable). Kept as the numeric seam the P23.2 pins read; the mark's
 * *shape* and relation word come from `plan-snap-grammar`, so this and the
 * glyph table are the same numbers by construction.
 */
export function snapMarkerRadiusPx(kind: string): number {
	return planSnapGlyph(kind as SnapFeatureKind).radiusPx;
}

/**
 * P23.13 S2 — the Plan scale floor is *re-exported* from the one gate table in
 * `plan-salience.ts` rather than defined here, so the overlay and the salience
 * policy can never drift into two different floors. The S3 placer replaced the
 * P23.6 area floor and point-suppression radius with text-box fitting and the
 * ratified obstacle reserves; §5's global `6 px/m` vocabulary floor stays.
 */
export const ROOM_LABEL_MIN_PX_PER_M = PLAN_ROOM_LABELS_MIN_PX_PER_M;
/** Junction handles hide below this Plan scale (mirrors grid-minor culling). */
export const JUNCTION_HANDLES_MIN_PX_PER_M = PLAN_ARCHITECTURE_CONTROLS_MIN_PX_PER_M;

function roomVertices(room: LayoutRoom): LayoutVec2[] {
	return room.boundary.segments.map((segment) => [...segment.start] as LayoutVec2);
}

function selectedPoints(interaction: LayoutInteractionState, selectedRoom: LayoutRoom | undefined): LayoutVec2[] {
	if (!selectedRoom) return [];
	if (interaction.editing?.roomId === selectedRoom.id) return interaction.editing.currentPoints;
	return roomVertices(selectedRoom);
}

/** World top-center of a room's plan bounds (min-Z edge midpoint = screen top). */
function roomTopCenter(model: LayoutPreviewModel, roomId: string): LayoutVec2 | null {
	const room = model.rooms.find((candidate) => candidate.roomId === roomId);
	if (!room) return null;
	const xs = room.floorPolygon.map(([x]) => x);
	const zs = room.floorPolygon.map(([, z]) => z);
	const minX = Math.min(...xs);
	const maxX = Math.max(...xs);
	const minZ = Math.min(...zs);
	return [(minX + maxX) / 2, minZ];
}

function rotationFeedbackText(interaction: LayoutInteractionState): string | null {
	const drag = interaction.roomUnitDrag;
	if (!drag || drag.mode !== 'rotate') return null;
	const degrees = Math.round((drag.yaw * 180) / Math.PI);
	return `${degrees >= 0 ? '+' : ''}${degrees}°`;
}

/** Editor selection → renderer-neutral selection identity for the model. */
function toPlanSelection(selection: LayoutSelection): PlanSelection {
	switch (selection.kind) {
		case 'none':
			return { kind: 'none' };
		case 'room':
			return { kind: 'room', roomId: selection.roomId };
		case 'wall':
			return { kind: 'wall', roomId: selection.roomId, segmentId: selection.segmentId };
		case 'opening':
			return { kind: 'opening', roomId: selection.roomId, segmentId: selection.segmentId, openingId: selection.openingId };
		case 'interiorAnchor':
			return { kind: 'interiorAnchor', roomId: selection.roomId, segmentId: selection.segmentId, anchorId: selection.anchorId };
		case 'object':
			return { kind: 'object', objectId: selection.objectId };
		case 'wallOpening':
			return { kind: 'wallOpening', wallId: selection.wallId, openingId: selection.openingId };
		case 'physicalWall':
			return { kind: 'physicalWall', wallId: selection.wallId };
		case 'junction':
			return { kind: 'junction', junctionId: selection.junctionId };
	}
}

/** Canonical Wall centerline endpoints from the compiled wall spans. */
export function physicalWallSpan(
	model: LayoutPreviewModel,
	wallId: string
): { start: LayoutVec2; end: LayoutVec2 } | null {
	const spans = model.queries.spans
		.filter(
			(span) =>
				span.roomId === undefined &&
				span.kind === 'wall' &&
				(span.wallKey ?? span.segmentId) === wallId
		)
		.sort((a, b) => a.startDistance - b.startDistance);
	const first = spans[0];
	const last = spans.at(-1);
	return first && last ? { start: [...first.start] as LayoutVec2, end: [...last.end] as LayoutVec2 } : null;
}

/** World point at a meter offset along a canonical Wall span (unclamped). */
export function pointAtWallOffset(
	span: { start: LayoutVec2; end: LayoutVec2 },
	offset: number
): LayoutVec2 {
	const dx = span.end[0] - span.start[0];
	const dz = span.end[1] - span.start[1];
	const length = Math.hypot(dx, dz);
	if (length <= 0) return [...span.start] as LayoutVec2;
	const t = offset / length;
	return [span.start[0] + dx * t, span.start[1] + dz * t];
}

/**
 * P23.3 — the two jamb points of one canonical Opening, from the compiled
 * query spans. ONE source for both the rendered width handles and the
 * viewport's screen-space handle hit test.
 */
export function wallOpeningEdgeWorldPoints(
	model: LayoutPreviewModel,
	openingId: string
): { start: LayoutVec2; end: LayoutVec2 } | null {
	const span = model.queries.spans.find(
		(candidate) => candidate.kind === 'opening' && candidate.openingId === openingId
	);
	return span ? { start: [...span.start] as LayoutVec2, end: [...span.end] as LayoutVec2 } : null;
}

/** Rendered canonical Opening affordances for one selected Opening. */
function pushWallOpeningAffordances(
	selection: { openingId: string },
	model: LayoutPreviewModel,
	planView: PlanViewportState,
	handles: PlanRenderPrimitive[],
	labels: PlanRenderPrimitive[]
): void {
		const edges = wallOpeningEdgeWorldPoints(model, selection.openingId);
	if (!edges) return;
	// P23.13 S4 / §6 — width edges are squares straddling the jamb (7 px), never
	// circles: shape carries the role so a Junction diamond, a width square and a
	// bend circle stay distinguishable in grayscale.
	const mark = PLAN_CONTROL_MARKS['opening-edge'];
	handles.push(
		{
			kind: 'circle',
			key: geometryId(['plan', 'overlay', 'opening-handle', selection.openingId, 'start']),
			center: edges.start,
			radiusPx: mark.radiusPx,
			shape: mark.shape,
			style: 'opening-handle'
		},
		{
			kind: 'circle',
			key: geometryId(['plan', 'overlay', 'opening-handle', selection.openingId, 'end']),
			center: edges.end,
			radiusPx: mark.radiusPx,
			shape: mark.shape,
			style: 'opening-handle'
		}
	);
	// §6 — the slide grip: a short PAIRED mark across the symbol center, so the
	// body drag reads as its own affordance rather than a third width handle.
	// Two bars perpendicular to the host, one either side of the center. This is
	// a screen-constant mark, so the world length is derived from the live scale
	// here (the overlay owns px thresholds) rather than baked into the model.
	const mid: LayoutVec2 = [(edges.start[0] + edges.end[0]) / 2, (edges.start[1] + edges.end[1]) / 2];
	const dx = edges.end[0] - edges.start[0];
	const dz = edges.end[1] - edges.start[1];
	const span = Math.hypot(dx, dz);
	const pixelsPerMeter = planView.pixelsPerMeter;
	if (span > 0 && pixelsPerMeter > 0) {
		const alongX = dx / span;
		const alongZ = dz / span;
		// Perpendicular to the host in Plan space (x, z), same convention as the
		// rest of the overlay's world math.
		const perpX = -alongZ;
		const perpZ = alongX;
		const offset = OPENING_SLIDE_GRIP_OFFSET_PX / pixelsPerMeter;
		const halfLength = OPENING_SLIDE_GRIP_HALF_LENGTH_PX / pixelsPerMeter;
		for (const side of [-1, 1]) {
			const centerX = mid[0] + alongX * offset * side;
			const centerZ = mid[1] + alongZ * offset * side;
			handles.push({
				kind: 'polyline',
				key: geometryId(['plan', 'overlay', 'opening-slide-grip', selection.openingId, String(side)]),
				points: [
					[centerX - perpX * halfLength, centerZ - perpZ * halfLength],
					[centerX + perpX * halfLength, centerZ + perpZ * halfLength]
				] as LayoutVec2[],
				style: 'opening-slide-grip'
			});
		}
	}
	// P23.13 S6 — the width readout that used to sit here is now derived: §7
	// gives a selected Opening its width as the selected-idle measure, so the
	// label comes from the dimension set with the witnesses that explain it
	// instead of from an ad-hoc string beside the handles.
}

/**
 * P23.3 — transient drag preview for one canonical Opening gesture. The
 * candidate renders valid or invalid exactly as the drag state reports it: a
 * raw candidate outside fit bounds previews invalid and commits nothing.
 */
function pushWallOpeningDragPreview(
	drag: LayoutInteractionState['wallOpeningDrag'],
	model: LayoutPreviewModel,
	drafts: PlanRenderPrimitive[],
	labels: PlanRenderPrimitive[]
): void {
	if (!drag) return;
	const span = physicalWallSpan(model, drag.wallId);
	if (!span) return;
	const width = Math.max(0, drag.candidateWidth);
	drafts.push({
		kind: 'polyline',
		key: geometryId(['plan', 'overlay', 'opening-drag-preview']),
		points: [pointAtWallOffset(span, drag.candidateOffset), pointAtWallOffset(span, drag.candidateOffset + width)],
		style: drag.valid ? 'opening-drag-preview' : 'opening-drag-preview-invalid'
	});
	// P23.13 S6 — the candidate's offset lives in the derived dimension set (§7's
	// Opening row: width plus offset and clearance), so this preview no longer
	// prints a second, differently-rounded copy of the same number.
}

/** Screen position of the rotation handle (top-center + 28px vertical offset). */
export function rotationHandleScreenPoint(
	planView: PlanViewportState,
	projection: PlanInteractionProjection
): LayoutVec2 | null {
	const handle = projection.selection.find(
		(primitive) => primitive.kind === 'circle' && primitive.style === 'rotation-handle'
	);
	if (!handle || handle.kind !== 'circle') return null;
	const base = worldToPlanScreen(planView, handle.center);
	return [base[0] + (handle.offsetPx?.[0] ?? 0), base[1] + (handle.offsetPx?.[1] ?? 0)];
}

/** Convert a world-space pivot/handle pair for a component-owned SVG overlay. */
export function planHandleScreenPoints(
	planView: PlanViewportState,
	pivot: LayoutVec2,
	handle: LayoutVec2
): { pivot: LayoutVec2; handle: LayoutVec2 } {
	return {
		pivot: worldToPlanScreen(planView, pivot),
		handle: worldToPlanScreen(planView, handle)
	};
}

/** Add the P2 Scene placement rotation arm without moving SVG rendering into the viewport. */
export function withPlanSceneRotationHandle(
	projection: PlanInteractionProjection,
	overlay: { entityId: string; pivot: LayoutVec2; handle: LayoutVec2 } | null,
	/** P3.3 — live degree readout while a rotate gesture is in progress. */
	feedback: string | null = null
): PlanInteractionProjection {
	if (!overlay) return projection;
	return {
		...projection,
		selection: [
			...projection.selection,
			{
				kind: 'polyline',
				key: geometryId(['plan', 'scene-overlay', 'rotation-arm', overlay.entityId]),
				points: [overlay.pivot, overlay.handle],
				style: 'rotation-arm'
			},
			{
				kind: 'circle',
				key: geometryId(['plan', 'scene-overlay', 'rotation-handle', overlay.entityId]),
				center: overlay.handle,
				radiusPx: 7,
				style: 'rotation-handle'
			},
			// Same live degree label the room rotation already shows (P3.3:
			// one rotation language for every owner).
			...(feedback
				? [{
						kind: 'text',
						key: geometryId(['plan', 'scene-overlay', 'rotation-feedback', overlay.entityId]),
						anchor: overlay.handle,
						text: feedback,
						offsetPx: [0, -ROTATION_FEEDBACK_OFFSET_PX],
						style: 'rotation-feedback'
					} satisfies PlanRenderPrimitive]
				: [])
		]
	};
}

/**
 * Add the P10 Plan layout-object yaw rotation arm (same handle contract as the
 * Scene staging handle; the layout-object handle orbits its own world pivot).
 */
export function withPlanObjectRotationHandle(
	projection: PlanInteractionProjection,
	overlay: { objectId: string; pivot: LayoutVec2; handle: LayoutVec2 } | null,
	/** P3.3 — live degree readout while a rotate gesture is in progress. */
	feedback: string | null = null
): PlanInteractionProjection {
	if (!overlay) return projection;
	return {
		...projection,
		selection: [
			...projection.selection,
			{
				kind: 'polyline',
				key: geometryId(['plan', 'object-overlay', 'rotation-arm', overlay.objectId]),
				points: [overlay.pivot, overlay.handle],
				style: 'rotation-arm'
			},
			{
				kind: 'circle',
				key: geometryId(['plan', 'object-overlay', 'rotation-handle', overlay.objectId]),
				center: overlay.handle,
				radiusPx: 7,
				style: 'rotation-handle'
			},
			...(feedback
				? [{
						kind: 'text',
						key: geometryId(['plan', 'object-overlay', 'rotation-feedback', overlay.objectId]),
						anchor: overlay.handle,
						text: feedback,
						offsetPx: [0, -ROTATION_FEEDBACK_OFFSET_PX],
						style: 'rotation-feedback'
					} satisfies PlanRenderPrimitive]
				: [])
		]
	};
}

/**
 * P23.10/P23.11 — one transient direct Wall/Junction edit intent: the attempt
 * the pointer is asking for, drawn from the immutable baseline while the
 * canonical planner has not yet ruled on it.
 *
 * Under the P23.11 transient contract this intent **is** the drag preview: the
 * canonical document stays installed for the whole gesture, so the attempted
 * geometry is rendered here instead of being installed per pointermove. The
 * intent is overlay truth only — never persisted, never validated here, and
 * never a substitute for the planner's verdict at release.
 */
export type LayoutArchitectureEditOverlayWall = {
	wallId: string;
	points: readonly LayoutVec2[];
};

type LayoutArchitectureEditIntentBody =
	| { kind: 'junction-move'; point: LayoutVec2; walls?: readonly LayoutArchitectureEditOverlayWall[] }
	| {
			kind: 'wall-move';
			start?: LayoutVec2;
			end?: LayoutVec2;
			walls?: readonly LayoutArchitectureEditOverlayWall[];
	  }
	/**
	 * P23.11 — a curve-control drag. The baseline stays installed; the attempted
	 * Wall is drawn from the caller's canonical **proposal** (never a fabricated
	 * curve), with the dragged control point marked on it. The render style
	 * follows the attempt's live status (`pending` vs `known-invalid`).
	 */
	| {
			kind: 'curve-control-move';
			point: LayoutVec2;
			shape?: readonly LayoutVec2[];
			walls?: readonly LayoutArchitectureEditOverlayWall[];
	  }
	/**
	 * P23.11 — a Bend-command drag. Same contract: the transient layer renders
	 * the proposal's attempted Wall shape and the dragged bend point, so the
	 * geometry keeps following the cursor for the whole gesture.
	 */
	| {
			kind: 'wall-bend';
			point: LayoutVec2;
			shape?: readonly LayoutVec2[];
			walls?: readonly LayoutArchitectureEditOverlayWall[];
	  };

/**
 * The live state of one direct-edit attempt.
 *
 * `known-invalid` means a **canonical, cheap** gate has already refuted the
 * attempt during the drag (`preflightWallFirstArchitectureCandidate`: crossing,
 * self-intersection, duplicate Junction point, zero-length Wall, broken Room
 * boundary) or the intent could not be derived at all. Everything a cheap gate
 * cannot decide — Room reconciliation, the Opening set, portal relations, the
 * compile — stays `pending` and is decided once, at release, by the canonical
 * planner that owns acceptance.
 */
export type TransientAttemptStatus = 'pending' | 'known-invalid';

/**
 * The attempt plus its render style.
 *
 * `invalid` renders the existing refused language; it is set from the attempt's
 * `TransientAttemptStatus`, never from a guess about what the release planner
 * will decide.
 */
export type LayoutArchitectureEditIntent = LayoutArchitectureEditIntentBody & {
	invalid?: boolean;
};

type LayoutArchitectureEditProposal =
	| readonly LayoutVec2[]
	| readonly LayoutArchitectureEditOverlayWall[];

function overlayWallsFromProposal(
	proposal: LayoutArchitectureEditProposal | null | undefined
): readonly LayoutArchitectureEditOverlayWall[] | null {
	if (!proposal) return null;
	if (proposal.length === 0) return [];
	if (Array.isArray(proposal[0])) return null;
	return proposal as readonly LayoutArchitectureEditOverlayWall[];
}

function legacyShapeFromProposal(
	proposal: LayoutArchitectureEditProposal | null | undefined
): readonly LayoutVec2[] | null {
	if (!proposal || proposal.length === 0 || !Array.isArray(proposal[0])) return null;
	return proposal as readonly LayoutVec2[];
}

/**
 * P23.10/P23.11 — the transient intent for one live direct edit, or `null`
 * when nothing should render.
 *
 * Nothing renders while the press is still a plain click (`moved === false`):
 * the pointer has not asked for geometry yet, so a press over a Wall must not
 * flash a candidate. After the shared drag threshold every move renders the
 * attempt the pointer is asking for, because under the transient contract the
 * canonical document is no longer written to preview it.
 */
export function architectureEditIntentFor(
	gesture: LayoutArchitectureEditGesture | null,
	moved: boolean,
	/**
	 * The caller's canonical architecture proposal for the live attempt:
	 * affected Wall centerlines sampled through the one core adapter. It is
	 * overlay truth only and is never installed, persisted or validated here; an
	 * absent proposal degrades to the attempt's point marker.
	 */
	proposal?: LayoutArchitectureEditProposal | null,
	/**
	 * P23.11 transient pass — the attempt's live status. A `known-invalid`
	 * attempt renders the existing refused language; `pending` renders the
	 * transient attempt language. This is the caller's cheap preflight verdict,
	 * not acceptance: the canonical planner still decides at release.
	 */
	status: TransientAttemptStatus = 'pending'
): LayoutArchitectureEditIntent | null {
	if (!gesture || !moved) return null;
	const refused = status === 'known-invalid' ? ({ invalid: true } as const) : {};
	const walls = overlayWallsFromProposal(proposal);
	// Point-anchored gestures render the attempted control/Junction point itself.
	if (gesture.kind !== 'wall-move') {
		const point: LayoutVec2 = [gesture.candidatePoint[0], gesture.candidatePoint[1]];
		if (walls) return { kind: gesture.kind, point, walls, ...refused };
		const legacyShape = legacyShapeFromProposal(proposal);
		if (
			(gesture.kind === 'curve-control-move' || gesture.kind === 'wall-bend') &&
			legacyShape &&
			legacyShape.length > 1
		) {
			return {
				kind: gesture.kind,
				point,
				shape: legacyShape.map((entry) => [entry[0], entry[1]] as LayoutVec2),
				...refused
			};
		}
		return { kind: gesture.kind, point, ...refused };
	}
	const [dx, dz] = gesture.candidateDelta;
	if (walls) return { kind: 'wall-move', walls, ...refused };
	return {
		kind: 'wall-move',
		start: [gesture.baselineStart[0] + dx, gesture.baselineStart[1] + dz],
		end: [gesture.baselineEnd[0] + dx, gesture.baselineEnd[1] + dz],
		...refused
	};
}

/**
 * Where an attempt's refusal belongs.
 *
 * Every intent kind has an attempted locus: a junction/curve control point, or —
 * for a whole-Wall move — the middle of the attempted Wall. A `wall-move` carries
 * no single point, so it is derived from the attempt's own centerline rather than
 * invented (the mark never appears at an arbitrary place).
 *
 * Exported because the **persisted** refusal annotation (S8) marks the same
 * point: the live invalid proposal and the mark that outlives it must not drift
 * to two different loci for one refused gesture, so both read this one function.
 */
export function architectureEditIntentLocus(
	intent: LayoutArchitectureEditIntent
): LayoutVec2 | null {
	if (intent.kind !== 'wall-move') return intent.point;
	const points = intent.walls?.[0]?.points ?? [];
	if (points.length >= 2) {
		const first = points[0];
		const last = points[points.length - 1];
		return [(first[0] + last[0]) / 2, (first[1] + last[1]) / 2];
	}
	return intent.start ?? null;
}

/**
 * P23.10/P23.11 — draw one transient direct-edit attempt with the existing
 * token family (never document truth, never history). The style follows the
 * intent: an underivable attempt renders in the refused language, a derivable
 * live one in the pending language.
 */
export function withArchitectureEditIntent(
	projection: PlanInteractionProjection,
	intent: LayoutArchitectureEditIntent | null
): PlanInteractionProjection {
	if (!intent) return projection;
	const style: PlanStyleToken = intent.invalid
		? 'architecture-edit-intent-invalid'
		: 'architecture-edit-intent';
	const primitives: PlanRenderPrimitive[] = [];
	if (intent.kind === 'wall-move') {
		if (intent.walls) {
			for (const wall of intent.walls) {
				if (wall.points.length < 2) continue;
				primitives.push({
					kind: 'polyline',
					key: geometryId(['plan', 'overlay', 'architecture-edit-intent', wall.wallId]),
					points: wall.points.map((entry) => [entry[0], entry[1]] as LayoutVec2),
					style
				});
			}
		} else if (intent.start && intent.end) {
			primitives.push({
				kind: 'polyline',
				key: geometryId(['plan', 'overlay', 'architecture-edit-intent']),
				points: [intent.start, intent.end],
				style
			});
		}
	} else {
		// P23.11 — a rejected curve drag renders the WHOLE attempted Wall shape
		// (the proposal's own centerline), not only a point, so the geometry keeps
		// tracking the cursor while it is invalid. The baseline document is still
		// what is installed, so no Room/Opening/3D consequence is drawn from it.
		const shape =
			intent.kind === 'curve-control-move' || intent.kind === 'wall-bend'
				? intent.shape
				: undefined;
		const walls = intent.walls;
		if (walls) {
			for (const wall of walls) {
				if (wall.points.length < 2) continue;
				primitives.push({
					kind: 'polyline',
					key: geometryId(['plan', 'overlay', 'architecture-edit-intent', wall.wallId]),
					points: wall.points.map((entry) => [entry[0], entry[1]] as LayoutVec2),
					style
				});
			}
		} else if (shape && shape.length > 1) {
			primitives.push({
				kind: 'polyline',
				key: geometryId(['plan', 'overlay', 'architecture-edit-intent', 'wall']),
				points: shape.map((entry) => [entry[0], entry[1]] as LayoutVec2),
				style
			});
		}
		primitives.push({
			kind: 'circle',
			key: geometryId(['plan', 'overlay', 'architecture-edit-intent']),
			center: intent.point,
			radiusPx: 7,
			style
		});
	}
	// §6 — a known-invalid proposal carries its own refusal: an octagonal stop
	// mark with an x at the attempted point, so refusal is legible in grayscale
	// and the proposal never asserts a success-coloured continuation. The mark is
	// local to the attempt; the owned geometry keeps its committed ink.
	const stopPoint = architectureEditIntentLocus(intent);
	if (intent.invalid && stopPoint) {
		primitives.push(
			{
				kind: 'circle',
				key: geometryId(['plan', 'overlay', 'refusal-stop']),
				center: stopPoint,
				radiusPx: REFUSAL_STOP_RADIUS_PX,
				shape: 'octagon',
				style: 'refusal-stop'
			},
			{
				kind: 'circle',
				key: geometryId(['plan', 'overlay', 'refusal-cross']),
				center: stopPoint,
				radiusPx: REFUSAL_STOP_RADIUS_PX,
				shape: 'cross',
				style: 'refusal-cross'
			}
		);
	}
	return { ...projection, drafts: [...projection.drafts, ...primitives] };
}

/**
 * P23.2 / P23.13 S5 — transient snap feedback as render primitives. Session
 * state only: the resolution is recomputed per pointer event and never mutates
 * the document or history.
 *
 * §7 asks for exactly three things and no more: **one** winner mark (shape +
 * short relation word), **at most one** guide, and a 2 px source accent. There
 * is no candidate cloud: the resolver's winner is the only point this draws, so
 * a pointer near three candidates still shows one relation.
 *
 * `options.explicitValue` is §7's precedence rule: an explicit numeric value
 * outranks a conflicting snap, so the winner mark is removed and the relation
 * is reported as `Exact value` instead. S7 owns the numeric editor that sets
 * it; S5 owns what the Plan then paints.
 */
export function withLayoutSnapFeedback(
	projection: PlanInteractionProjection,
	resolution: SnapResolution | null,
	options: { explicitValue?: boolean; view?: PlanViewportState } = {}
): PlanInteractionProjection {
	if (!resolution || resolution.kind !== 'snap') return projection;
	const { candidate, guides } = resolution;
	const primitives: PlanRenderPrimitive[] = [];
	if (options.explicitValue) {
		// The relation is reported, the claim is withdrawn: no mark, no guide, so
		// nothing on the canvas asserts an honoured snap. The word still says why.
		primitives.push({
			kind: 'text',
			key: geometryId(['plan', 'snap-feedback', 'exact-value', candidate.sourceId]),
			anchor: candidate.point,
			text: PLAN_SNAP_EXACT_VALUE_LABEL,
			offsetPx: planSnapRelationLabelOffsetPx(
				PLAN_SNAP_EXACT_VALUE_LABEL,
				candidate.point,
				options.view
			),
			style: 'snap-relation-label'
		});
		return { ...projection, drafts: [...projection.drafts, ...primitives] };
	}
	const glyph = planSnapGlyph(candidate.kind);
	// §7 allows one guide. The resolver already emits at most one for a winner
	// (`guidesForCandidate`), and this cap keeps that a presentation guarantee
	// rather than a property the overlay merely inherits: a caller passing a
	// hand-built resolution cannot turn the canvas into a candidate cloud.
	const [guide] = guides;
	if (guide) {
		primitives.push({
			kind: 'polyline',
			key: geometryId(['plan', 'snap-feedback', 'guide', candidate.sourceId]),
			points: [guide.start, guide.end],
			style: 'snap-guide'
		});
	}
	primitives.push(
		{
			kind: 'circle',
			key: geometryId(['plan', 'snap-feedback', 'marker', candidate.sourceId]),
			center: candidate.point,
			radiusPx: glyph.radiusPx,
			shape: glyph.shape === 'dot' ? 'circle' : glyph.shape,
			// The glyph's own ink, not a per-family exception: an open shape needs
			// the snap ink as a stroke, a closed one as a fill. Choosing by kind
			// here is what let the grid fallback and the bracket diverge from the
			// rest of the table.
			style: glyph.ink === 'stroke' ? 'snap-glyph-stroke' : 'snap-marker'
		},
		{
			kind: 'text',
			key: geometryId(['plan', 'snap-feedback', 'relation', candidate.sourceId]),
			anchor: candidate.point,
			text: glyph.label,
			offsetPx: planSnapRelationLabelOffsetPx(glyph.label, candidate.point, options.view),
			style: 'snap-relation-label'
		}
	);
	return { ...projection, drafts: [...projection.drafts, ...primitives] };
}

/**
 * P23.13 S6 — the canonical numeric truth the dimension derivation reads (spec
 * §7). Every answer comes from the compiled model the projection already has:
 *
 * - **Arc length**, straight or curved, is `compiledPhysicalWallLength` — the
 *   last compiled span's `endDistance`. One number, one source, so a curved
 *   Wall's length can never become the chord between its endpoints.
 * - **Whether the host is straight** is `dedupeWallSpans`' `straight` flag, the
 *   compiled-geometry answer the snap engine already relies on, rather than a
 *   heuristic over how many samples happened to be emitted.
 * - **The bracketable span** is only offered for a straight Wall: a curved
 *   Wall's own start/end is its chord, and bracketing it would publish a shorter
 *   wall than the one that exists.
 * - **Clearance** is passive working information (§7): the smallest gap from the
 *   Opening to a host end or a neighbouring Opening, and `null` when the host
 *   has neither.
 */
function planDimensionFacts(model: LayoutPreviewModel): PlanDimensionFacts {
	const merges = new Map(
		dedupeWallSpans(model.queries.spans.filter((span) => span.kind === 'wall')).map((merge) => [
			merge.key,
			merge
		])
	);
	const openingSpans = model.queries.spans.filter(
		(span) => span.kind === 'opening' && span.openingId !== undefined
	);
	return {
		wallLength: (wallKey) =>
			merges.has(wallKey) ? compiledPhysicalWallLength(model.queries, wallKey) : null,
		wallIsStraight: (wallKey) => merges.get(wallKey)?.straight ?? true,
		wallSpan: (wallKey) => {
			const merge = merges.get(wallKey);
			if (!merge || !merge.straight) return null;
			return [merge.start, merge.end] as const;
		},
		wallAnchor: (wallKey) => {
			const merge = merges.get(wallKey);
			if (!merge) return null;
			if (merge.straight) return midpointOf(merge.start, merge.end);
			// A curved host's label sits on the curve, not on the chord: walk the
			// canonical spans to the half-arc point.
			const spans = model.queries.spans
				.filter(
					(span) => span.kind === 'wall' && (span.wallKey ?? span.segmentId) === wallKey
				)
				.sort((a, b) => a.startDistance - b.startDistance);
			let total = 0;
			for (const span of spans) total += Math.hypot(span.end[0] - span.start[0], span.end[1] - span.start[1]);
			let walked = 0;
			for (const span of spans) {
				const length = Math.hypot(span.end[0] - span.start[0], span.end[1] - span.start[1]);
				if (walked + length >= total / 2) {
					const t = length > 0 ? (total / 2 - walked) / length : 0;
					return [span.start[0] + (span.end[0] - span.start[0]) * t, span.start[1] + (span.end[1] - span.start[1]) * t] as LayoutVec2;
				}
				walked += length;
			}
			return spans.length > 0 ? ([...spans[spans.length - 1]!.end] as LayoutVec2) : null;
		},
		opening: (wallKey, openingId) => {
			const edges = wallOpeningEdgeWorldPoints(model, openingId);
			const spans = openingSpans.filter((span) => span.openingId === openingId);
			const first = spans[0];
			if (!edges || !first) return null;
			const width = Math.hypot(edges.end[0] - edges.start[0], edges.end[1] - edges.start[1]);
			const offset = first.startDistance;
			const hostLength = compiledPhysicalWallLength(model.queries, wallKey);
			const gaps: number[] = [offset, hostLength - (offset + width)];
			for (const span of openingSpans) {
				if (span.openingId === openingId) continue;
				if (span.roomId !== undefined) continue;
				if ((span.wallKey ?? span.segmentId) !== wallKey) continue;
				const spanWidth = Math.hypot(span.end[0] - span.start[0], span.end[1] - span.start[1]);
				gaps.push(Math.abs(span.startDistance - (offset + width)));
				gaps.push(Math.abs(offset - (span.startDistance + spanWidth)));
			}
			const finite = gaps.filter((gap) => Number.isFinite(gap) && gap >= 0);
			return {
				width,
				offset,
				span: [edges.start, edges.end] as const,
				anchor: midpointOf(edges.start, edges.end),
				clearance: finite.length > 0 ? Math.min(...finite) : null
			};
		}
	};
}

function midpointOf(a: LayoutVec2, b: LayoutVec2): LayoutVec2 {
	return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/**
 * P23.13 S6 — derive §7's dimension set from the live gesture, place it on the
 * canvas (lanes, frozen side, witnesses, ticks, text) and hand back whatever had
 * to move to the readout. Presentation only: nothing here is document state,
 * history, or an input to any planner.
 */
function pushPlanDimensions(
	interaction: LayoutInteractionState,
	model: LayoutPreviewModel,
	context: PlanDimensionContext | undefined,
	drafts: PlanRenderPrimitive[],
	labels: PlanRenderPrimitive[]
): { readout: { key: string; measure: string; value: string }[] } {
	const dimensions = derivePlanDimensions(interaction, planDimensionFacts(model));
	if (dimensions.length === 0) return { readout: [] };
	const view = interaction.planView;
	const outcome = placePlanDimensions(dimensions, view, {
		memory: context?.memory,
		gestureKey: planDimensionGestureKey(interaction)
	});
	/**
	 * Placement works in screen pixels — lanes, witnesses, ticks and the text
	 * push-out are px measurements — but a render primitive is world geometry the
	 * paint layer projects (the plan pans and zooms under a live dimension). So
	 * every placed point is converted back through the same transform it was
	 * measured in, which is exactly the round trip the text anchor already uses:
	 * one instrument, one space, no second scale to keep in sync.
	 */
	const toWorld = (point: LayoutVec2): LayoutVec2 => planScreenToWorld(view, point);
	for (const placement of outcome.placed) {
		for (const [index, witness] of placement.witnesses.entries()) {
			drafts.push({
				kind: 'polyline',
				key: geometryId(['plan', 'overlay', 'dimension-witness', placement.key, String(index)]),
				points: [toWorld(witness[0]), toWorld(witness[1])],
				style: 'dimension-witness'
			});
		}
		if (placement.line) {
			drafts.push({
				kind: 'polyline',
				key: geometryId(['plan', 'overlay', 'dimension-line', placement.key]),
				points: [toWorld(placement.line[0]), toWorld(placement.line[1])],
				style: 'dimension-witness'
			});
		}
		for (const [index, tick] of placement.ticks.entries()) {
			drafts.push({
				kind: 'polyline',
				key: geometryId(['plan', 'overlay', 'dimension-tick', placement.key, String(index)]),
				points: [toWorld(tick[0]), toWorld(tick[1])],
				style: 'dimension-witness'
			});
		}
		const dimension = dimensions.find((candidate) => candidate.key === placement.key);
		if (!dimension) continue;
		// The paint layer lays text out from its anchor and applies the offset, so
		// the placed screen point is converted back into a world anchor plus a
		// screen offset — the same mechanism every other label uses, which keeps
		// the dimension on the paper scale (§7: never scale text).
		const anchor = worldToPlanAnchor(placement.text, view);
		// P23.13 S8 / D1 — a value on the drawing is ink, not a target: the pointer
		// door (underlined values, a click that opens a field on one) is retired, so
		// every value paints as plain ink. The keyboard door is untouched — Enter on
		// the selection's own measure still opens the same editor, and that rule is
		// still `planNumericRestingEntryTarget` (the viewport's, not the paint layer's).
		labels.push({
			kind: 'text',
			key: geometryId(['plan', 'overlay', 'dimension-text', placement.key]),
			anchor: anchor.point,
			offsetPx: anchor.offsetPx,
			text: planDimensionText(dimension),
			style: 'dimension-label'
		});
	}
	return { readout: [...outcome.readout] };
}

/**
 * P23.13 S7 — where a numeric field has to sit: **on the value it replaces**.
 *
 * §7 says "Entry replaces the displayed value with a small input at the same
 * location". That location is a screen point, and the only honest way to know it
 * is to read it back from the primitive that draws it — the placed dimension
 * text's world anchor plus the screen offset the paint layer applies — rather
 * than to re-derive a second placement that can drift from the instrument. The
 * conversion lives here, next to the placement that produced the ink, because the
 * viewport is forbidden the world→screen transform by construction (see
 * `plan-render-boundary.test.ts`): the paint layer and this module place; the
 * viewport only hosts.
 *
 * `fallbackWorld` covers the cases where the measure has no live ink — a span so
 * short its text moved to the readout, or a host whose instrument does not exist
 * yet — by landing on the pending origin at §7's first lane offset, because an
 * editor with nothing to sit on still has to appear somewhere rather than at
 * (0, 0).
 */
export function planNumericEntryAnchorPx(
	view: PlanViewportState,
	labels: readonly PlanRenderPrimitive[],
	options: { measureKey: string | null; fallbackWorld: LayoutVec2 | null }
): LayoutVec2 | null {
	if (options.measureKey) {
		const key = geometryId(['plan', 'overlay', 'dimension-text', options.measureKey]);
		const label = labels.find((primitive) => primitive.kind === 'text' && primitive.key === key);
		if (label && label.kind === 'text') {
			const projected = worldToPlanScreen(view, label.anchor);
			return [
				projected[0] + (label.offsetPx?.[0] ?? 0),
				projected[1] + (label.offsetPx?.[1] ?? 0)
			];
		}
	}
	if (!options.fallbackWorld) return null;
	const projected = worldToPlanScreen(view, options.fallbackWorld);
	return [projected[0], projected[1] - PLAN_DIMENSION_LANES_PX.first];
}

/**
 * Screen point → (world anchor, screen offset) so a placed label rides the same
 * offset mechanism as every other Plan label instead of escaping the transform.
 */
function worldToPlanAnchor(
	screen: LayoutVec2,
	view: PlanViewportState
): { point: LayoutVec2; offsetPx: readonly [number, number] } {
	const point = planScreenToWorld(view, screen);
	const projected = worldToPlanScreen(view, point);
	return { point, offsetPx: [screen[0] - projected[0], screen[1] - projected[1]] };
}

/** Shared `+NN°` gesture feedback formatting (matches the room label). */
export function yawFeedbackText(yaw: number): string {
	const degrees = Math.round((yaw * 180) / Math.PI);
	return `${degrees >= 0 ? '+' : ''}${degrees}°`;
}

/**
 * P3.3 — the hovered Arrange target's outline as a render primitive, so the
 * presentation-only hover flows through the same projection → PlanSvg path
 * as every other plan visual (the viewport owns no world→screen transform).
 */
export function withArrangeHoverOutline(
	projection: PlanInteractionProjection,
	outline: { id: string; points: readonly LayoutVec2[] } | null
): PlanInteractionProjection {
	if (!outline) return projection;
	return {
		...projection,
		selection: [
			...projection.selection,
			{
				kind: 'polygon',
				key: geometryId(['plan', 'arrange-hover', outline.id]),
				points: [...outline.points],
				style: 'arrange-hover'
			}
		]
	};
}

function draftPolyline(interaction: LayoutInteractionState): LayoutVec2[] | null {
	if (interaction.tool === 'rectangle') return rectanglePoints(interaction);
	if (wallChainRoleForTool(interaction.tool) !== null) {
		if (!interaction.wallChainStart) return null;
		// P23.9 segment-first — only the currently previewed next segment is
		// transient: committed Walls live in the document, never here.
		return interaction.wallChainCursor
			? [interaction.wallChainStart, interaction.wallChainCursor]
			: [interaction.wallChainStart];
	}
	return interaction.polygonPoints.length > 0 ? interaction.polygonPoints : null;
}

/** P23.9 — the active sketch's role, for explicit Wall vs Partition feedback. */
function draftStyle(interaction: LayoutInteractionState): PlanStyleToken {
	return wallChainRoleForTool(interaction.tool) === 'partition' ? 'draft-outline-partition' : 'draft-outline';
}

function ghostStyle(interaction: LayoutInteractionState): PlanStyleToken {
	const draft = interaction.primitiveDraft;
	if (!draft) return 'primitive-ghost';
	if (!draft.valid) return 'primitive-ghost-invalid';
	if (draft.kind === 'sphere') return 'primitive-ghost-sphere';
	if (draft.kind === 'cylinder') return 'primitive-ghost-circle';
	return 'primitive-ghost';
}

/** P23.5 — the preset ID a preset tool authors (`preset-column` → `column`). */
export function presetIdForTool(tool: LayoutPresetTool): LayoutArchitecturalPresetId {
	return tool.replace(/^preset-/, '') as LayoutArchitecturalPresetId;
}

/**
 * P23.5 — one-click preset footprint preview (presentation only). Resolves
 * the tool's preset dimensions; `null` when no candidate is live or the
 * preset table is missing the tool (which would be a wiring bug).
 */
function presetGhostPoints(interaction: LayoutInteractionState): LayoutVec2[] | null {
	const draft = interaction.presetDraft;
	if (!draft) return null;
	if (!isLayoutPresetTool(draft.tool)) return null;
	const preset = layoutArchitecturalPreset(presetIdForTool(draft.tool));
	if (!preset || !draft.valid) return null;
	const [width, , depth] = preset.dimensions;
	const [x, z] = draft.point;
	const halfWidth = width / 2;
	const halfDepth = depth / 2;
	if (preset.kind === 'cylinder') {
		const radius = Math.max(halfWidth, halfDepth);
		return Array.from({ length: 32 }, (_, index) => {
			const angle = (index / 32) * Math.PI * 2;
			return [x + Math.cos(angle) * radius, z + Math.sin(angle) * radius] as LayoutVec2;
		});
	}
	return [
		[x - halfWidth, z - halfDepth],
		[x + halfWidth, z - halfDepth],
		[x + halfWidth, z + halfDepth],
		[x - halfWidth, z + halfDepth]
	];
}

export function buildPlanInteractionProjection(
	interaction: LayoutInteractionState,
	rooms: readonly LayoutRoom[],
	model: LayoutPreviewModel,
	wallFirst?: PlanWallFirstContext,
	hovered?: PlanHitIdentity
): PlanInteractionProjection {
	const selection: PlanRenderPrimitive[] = [];
	const handles: PlanRenderPrimitive[] = [];
	const drafts: PlanRenderPrimitive[] = [];
	const labels: PlanRenderPrimitive[] = [];

	// P23.6a amendment A — a wall-first Room-unit drag moves the whole connected
	// Room group. Every member shows its moving bounds while the gesture is live,
	// so the unit that will commit is visible rather than inferred.
	const draggedGroupRoomIds = interaction.roomUnitDrag?.groupRoomIds ?? [];
	if (draggedGroupRoomIds.length > 1) {
		for (const memberRoomId of draggedGroupRoomIds) {
			const member = model.rooms.find((room) => room.roomId === memberRoomId);
			if (!member || member.floorPolygon.length === 0) continue;
			selection.push({
				kind: 'polygon',
				key: geometryId(['plan', 'overlay', 'group-move-bounds', memberRoomId]),
				points: member.floorPolygon.map(([x, z]) => [x, z] as LayoutVec2),
				style: 'selection-bounds'
			});
		}
	}

	const activeSelection = interaction.selection;
	const selectedRoom =
		interaction.tool === 'select' && activeSelection.kind === 'room'
			? rooms.find((room) => room.id === activeSelection.roomId)
			: undefined;
	const points = selectedPoints(interaction, selectedRoom);

	if (selectedRoom && points.length > 0) {
		selection.push({
			kind: 'polygon',
			key: geometryId(['plan', 'overlay', 'selection-bounds', selectedRoom.id]),
			points: points.map(([x, z]) => [x, z] as LayoutVec2),
			style: 'selection-bounds'
		});
		// Locked Decision 7 — a canonical wall-first Room has no authored yaw: its
		// shape **is** the Walls around it, so a rotation gesture has no honest
		// result to commit. The arm and its handle are therefore suppressed at this
		// seam (paint first, and through it the handle hit test that starts the
		// drag) instead of being offered and then refused. Scene staging's arm and
		// the P10 layout-object yaw arm are untouched — they rotate owners that do
		// carry their own yaw.
		const topCenter = !wallFirst ? roomTopCenter(model, selectedRoom.id) : null;
		if (topCenter) {
			selection.push({
				kind: 'polyline',
				key: geometryId(['plan', 'overlay', 'rotation-arm', selectedRoom.id]),
				points: [topCenter, topCenter],
				endOffsetPx: [0, -ROTATION_HANDLE_OFFSET_PX],
				style: 'rotation-arm'
			});
			selection.push({
				kind: 'circle',
				key: geometryId(['plan', 'overlay', 'rotation-handle', selectedRoom.id]),
				center: topCenter,
				radiusPx: 7,
				offsetPx: [0, -ROTATION_HANDLE_OFFSET_PX],
				style: 'rotation-handle',
				hit: { kind: 'room', roomId: selectedRoom.id }
			});
			const feedback = rotationFeedbackText(interaction);
			if (feedback) {
				selection.push({
					kind: 'text',
					key: geometryId(['plan', 'overlay', 'rotation-feedback', selectedRoom.id]),
					anchor: topCenter,
					text: feedback,
					offsetPx: [0, -ROTATION_FEEDBACK_OFFSET_PX],
					style: 'rotation-feedback'
				});
			}
		}
		for (const [index, point] of points.entries()) {
			handles.push({
				kind: 'circle',
				key: geometryId(['plan', 'overlay', 'vertex-handle', selectedRoom.id, String(index)]),
				center: point,
				radiusPx: 6,
				style: 'vertex-handle',
				hit: { kind: 'vertex', roomId: selectedRoom.id, vertexIndex: index } satisfies PlanHitIdentity
			});
		}
		// P23.13 S6 / §7 — a selected Room shows **no dimension chain**. Its area
		// belongs to the S3 identity stack and its edges are not working
		// information once nothing is being edited, so the old per-edge labels are
		// replaced rather than restyled: a selected Room is not a measured one.
	}

	for (const record of model.queries.points) {
		if (record.kind !== 'interior-anchor') continue;
		if (record.roomId === undefined) continue;
		handles.push({
			kind: 'circle',
			key: geometryId(['plan', 'overlay', 'interior-anchor', record.roomId, record.segmentId, record.sourceId]),
			center: record.point,
			radiusPx: 5,
			style: activeSelection.kind === 'interiorAnchor' &&
				activeSelection.roomId === record.roomId &&
				activeSelection.segmentId === record.segmentId &&
				activeSelection.anchorId === record.sourceId
				? 'interior-anchor-selected'
				: 'interior-anchor',
			hit: { kind: 'interiorAnchor', roomId: record.roomId, segmentId: record.segmentId, anchorId: record.sourceId } satisfies PlanHitIdentity
		});
	}

	if (interaction.primitiveDraft) {
		drafts.push({
			kind: 'polygon',
			key: geometryId(['plan', 'overlay', 'primitive-ghost']),
			points: primitiveDraftFootprint(interaction.primitiveDraft),
			style: ghostStyle(interaction)
		});
	}

	// P23.5 — the preset candidate previews the same ghost language as a
	// primitive draft (footprint of the object the preset will create).
	const presetGhost = presetGhostPoints(interaction);
	if (presetGhost) {
		drafts.push({
			kind: 'polygon',
			key: geometryId(['plan', 'overlay', 'preset-ghost']),
			points: presetGhost,
			style: 'primitive-ghost'
		});
	}

	const draft = draftPolyline(interaction);
	if (draft) {
		// P23.6 — the pending candidate leg carries a live passive length
		// readout (presentation only, never authored state), a run-closure cue
		// when the cursor sits on the run's starting Junction, and an invalid
		// treatment for the degenerate zero-length leg.
		const chainLeg =
			wallChainRoleForTool(interaction.tool) !== null &&
			interaction.wallChainStart &&
			interaction.wallChainCursor &&
			draft.length === 2
				? {
						start: interaction.wallChainStart,
						cursor: interaction.wallChainCursor,
						length: Math.hypot(
							interaction.wallChainCursor[0] - interaction.wallChainStart[0],
							interaction.wallChainCursor[1] - interaction.wallChainStart[1]
						)
					}
				: null;
		const snapTolerance =
			LAYOUT_PLAN_SNAP_RADIUS_CSS_PX / Math.max(interaction.planView.pixelsPerMeter, 1e-6);
		const closing =
			chainLeg !== null &&
			wallFirst?.runStartPoint !== null &&
			wallFirst?.runStartPoint !== undefined &&
			Math.hypot(
				chainLeg.cursor[0] - wallFirst.runStartPoint[0],
				chainLeg.cursor[1] - wallFirst.runStartPoint[1]
			) <= snapTolerance;
		const degenerate = chainLeg !== null && !closing && chainLeg.length <= 1e-6;
		drafts.push({
			kind: 'polyline',
			key: geometryId(['plan', 'overlay', 'draft-outline']),
			points: draft,
			style: degenerate ? 'draft-outline-invalid' : draftStyle(interaction)
		});
		for (const [index, point] of draft.entries()) {
			drafts.push({
				kind: 'circle',
				key: geometryId(['plan', 'overlay', 'draft-point', String(index)]),
				center: point,
				radiusPx: 5,
				style: 'draft-point'
			});
		}
		// P23.13 S8 / §7 — the cue is decided by canonical evidence, not by
		// proximity. `closing` stays this layer's own rule; the *face* can only
		// come from the viewport's plan of the closing leg, so a `room-face` cue
		// cannot exist unless the planner produced that face, and a candidate with
		// no evidence says `Close at junction` and promises no Room at all.
		const closureCue = resolvePlanClosureCue({
			tool: wallChainRoleForTool(interaction.tool) === 'partition' ? 'partition-draw' : 'wall-draw',
			closing,
			yieldsFace: (wallFirst?.closureFaces?.length ?? 0) > 0
		});
		if (chainLeg && !degenerate && closureCue !== 'none' && wallFirst?.runStartPoint) {
			const runStart = [...wallFirst.runStartPoint] as LayoutVec2;
			if (closureCue === 'room-face') {
				for (const [index, face] of (wallFirst?.closureFaces ?? []).entries()) {
					if (face.length < 3) continue;
					drafts.push({
						kind: 'polygon',
						key: geometryId(['plan', 'overlay', 'closure-wash', String(index)]),
						points: face.map((point) => [point[0], point[1]] as LayoutVec2),
						style: 'closure-wash'
					});
				}
			}
			// P23.13 S6 — the closure cue is not a dimension, so it never rides on the
			// leg's length string (the old `Close · 4.00 m` made one label answer two
			// questions).
			drafts.push({
				kind: 'circle',
				key: geometryId(['plan', 'overlay', 'closure-cue']),
				center: runStart,
				radiusPx: 6,
				style: 'snap-marker'
			});
			if (closureCue === 'close-at-junction') {
				labels.push({
					kind: 'text',
					key: geometryId(['plan', 'overlay', 'closure-cue-label']),
					anchor: runStart,
					text: PLAN_CLOSE_AT_JUNCTION_COPY,
					offsetPx: [0, -DIMENSION_LABEL_OFFSET_PX],
					style: 'dimension-label'
				});
			}
		}
	}

	// P23.3 — canonical Opening affordances + transient drag preview. Both are
	// session-only projections: no document write ever happens during a drag.
	// P23.13 S4 / §5 — they are §6 controls like any other, so they stand down
	// under the same Plan vocabulary floor: an affordance below it is not drawn
	// and therefore must not be a pointer target either.
	if (
		activeSelection.kind === 'wallOpening' &&
		interaction.planView.pixelsPerMeter >= JUNCTION_HANDLES_MIN_PX_PER_M
	) {
		pushWallOpeningAffordances(activeSelection, model, interaction.planView, handles, labels);
	}
	pushWallOpeningDragPreview(interaction.wallOpeningDrag, model, drafts, labels);

	const roomOverrides = interaction.editing
		? [{ roomId: interaction.editing.roomId, points: interaction.editing.currentPoints }]
		: [];

	const objectOverrides = interaction.objectDrag
		? model.objects
				.filter((object) => object.objectId === interaction.objectDrag!.objectId)
				.map((object) => {
					const drag = interaction.objectDrag!;
					const dx = drag.candidatePosition[0] - drag.originalPosition[0];
					const dz = drag.candidatePosition[2] - drag.originalPosition[2];
					const yawDelta = drag.candidateRotation[1] - drag.originalRotation[1];
					if (Math.abs(yawDelta) <= 1e-9) {
						return {
							objectId: object.objectId,
							points: object.planFootprint.map(([x, z]) => [x + dx, z + dz] as LayoutVec2)
						};
					}
					// Rotate around the object's world pivot using the shared positive-Y
					// Plan convention, then apply the translate delta.
					const cos = Math.cos(yawDelta);
					const sin = Math.sin(yawDelta);
					const pivot: LayoutVec2 = [object.position[0], object.position[2]];
					return {
						objectId: object.objectId,
						points: object.planFootprint.map(([x, z]) => {
							const lx = x - pivot[0];
							const lz = z - pivot[1];
							return [pivot[0] + cos * lx + sin * lz + dx, pivot[1] - sin * lx + cos * lz + dz] as LayoutVec2;
						})
					};
				})
		: [];

	// P23.6 — canonical Junction handles: normally quiet, visible and
	// interactive when tool/selection context requires them (chain sketching,
	// or a Wall/Opening/Junction selected). A lone hover also reveals its own
	// Junction — and only that one — so an endpoint quietly appears before the
	// click that selects it. Never global clutter: hidden below the Plan scale
	// floor, and focused to the selected Wall's endpoints when a Wall selection
	// owns the context.
	//
	// P23.11 — curve controls draw on the same layer and under the same scale
	// floor, but BELOW the Junction handles: a Junction outranks a control in
	// hit authority, so it must also read as the nearer affordance. The control
	// being dragged shows hover language while the pointer holds it.
	if (wallFirst && wallFirst.curveControls.length > 0) {
		if (interaction.planView.pixelsPerMeter >= JUNCTION_HANDLES_MIN_PX_PER_M) {
			for (const control of wallFirst.curveControls) {
				const active =
					hovered?.kind === 'wallCurveControl' &&
					hovered.wallId === control.wallId &&
					hovered.anchorId === control.anchorId;
				handles.push({
					kind: 'circle',
					key: geometryId(['plan', 'overlay', 'curve-control', control.wallId, control.anchorId]),
					center: [control.point[0], control.point[1]] as LayoutVec2,
					radiusPx: PLAN_CONTROL_MARKS['curve-control'].radiusPx,
					shape: PLAN_CONTROL_MARKS['curve-control'].shape,
					style: active ? 'curve-control-hovered' : 'curve-control',
					hit: {
						kind: 'wallCurveControl',
						wallId: control.wallId,
						anchorId: control.anchorId
					} satisfies PlanHitIdentity
				});
			}
		}
	}

	if (wallFirst) {
		const chainArmed = wallChainRoleForTool(interaction.tool) !== null;
		const selection = interaction.selection;
		const editContext =
			chainArmed ||
			selection.kind === 'physicalWall' ||
			selection.kind === 'wallOpening' ||
			selection.kind === 'junction';
		const hoveredJunctionId = hovered?.kind === 'junction' ? hovered.junctionId : null;
		const showJunctions = editContext || hoveredJunctionId !== null;
		if (showJunctions && interaction.planView.pixelsPerMeter >= JUNCTION_HANDLES_MIN_PX_PER_M) {
			for (const junction of wallFirst.junctions) {
				if (!editContext && junction.id !== hoveredJunctionId) continue;
				if (editContext && wallFirst.junctionFocus && !wallFirst.junctionFocus.has(junction.id)) continue;
				const selected = selection.kind === 'junction' && selection.junctionId === junction.id;
				handles.push({
					kind: 'circle',
					key: geometryId(['plan', 'overlay', 'junction-handle', junction.id]),
					center: [...junction.point] as LayoutVec2,
					radiusPx: PLAN_CONTROL_MARKS.junction.radiusPx,
					// §6 — the diamond is the topology affordance: a Junction or a Wall
					// endpoint is a topology point, so it must not read as a bend circle.
					shape: PLAN_CONTROL_MARKS.junction.shape,
					style: selected
						? 'vertex-handle-selected'
						: hovered?.kind === 'junction' && hovered.junctionId === junction.id
							? 'vertex-handle-hovered'
							: 'vertex-handle',
					hit: { kind: 'junction', junctionId: junction.id }
				});
			}
		}
	}

	// P23.13 S4 / §6 — control focus. Painted over every other state (last in
	// the handle layer): a paper moat, then a dark double ring. Drawn only; no
	// hit path reads it, and it never changes selection or history. The owner's
	// control net and true reference centerline come with it, so focus/drag shows
	// the geometry the control actually governs.
	if (wallFirst?.focus) {
		const focus = wallFirst.focus;
		const center = focus.point;
		// The owner's authored control net. For a curve this is the bend net, so it
		// must come from the document — never from a flattened centerline, which
		// would render the net as a straight chord over the curve it describes.
		if (focus.geometry && focus.geometry.controlPoints.length > 1) {
			handles.push({
				kind: 'polyline',
				key: geometryId(['plan', 'overlay', 'control-polygon']),
				points: focus.geometry.controlPoints.map((point) => [...point] as LayoutVec2),
				style: 'control-polygon'
			});
		}
		// One primitive per opening-free span. The compiled centerline is split
		// around authored cuts, so a single flattened polyline would draw a phantom
		// segment straight across every Opening on the host Wall.
		focus.geometry?.centerlineSpans.forEach((span, index) => {
			if (span.length < 2) return;
			handles.push({
				kind: 'polyline',
				key: geometryId(['plan', 'overlay', 'control-centerline', String(index)]),
				points: span.map((point) => [...point] as LayoutVec2),
				style: 'control-centerline'
			});
		});
		// §6 — "dark double ring with paper moat". Two dark rings separated by a
		// paper gap, and the whole system clear of the mark's own outline, so the
		// focused control stays legible *inside* its ring rather than being erased
		// by it. Radii are derived from the mark's circumscribed radius, so a
		// square/diamond corner is cleared exactly like a circle's edge.
		const clearance = focus.radiusPx * FOCUS_RING_CLEARANCE_FACTOR + FOCUS_RING_OFFSET_PX;
		for (const [suffix, radiusPx, style] of [
			['moat', clearance, 'focus-moat'],
			['ring-inner', clearance + FOCUS_RING_GAP_PX, 'focus-ring'],
			['moat-inner', clearance + FOCUS_RING_GAP_PX * 2, 'focus-moat'],
			['ring-outer', clearance + FOCUS_RING_GAP_PX * 3, 'focus-ring']
		] as const) {
			handles.push({
				kind: 'circle',
				key: geometryId(['plan', 'overlay', 'focus', suffix]),
				center: [...center] as LayoutVec2,
				radiusPx,
				style
			});
		}
	}

	// P23.6 — committed topology/geometry diagnostics as Plan markers (state,
	// not transient preview). Positioned from the affected source Wall/Room;
	// the concise reason lives in the Inspector topology section. Issues
	// without a resolvable target keep their count only — never a guess.
	// Markers land before Room labels so diagnostics outrank names.
	if (wallFirst) {
		for (const issue of wallFirst.issues) {
			const point = diagnosticPoint(model, issue.targetId);
			if (!point) continue;
			handles.push({
				kind: 'circle',
				key: geometryId(['plan', 'overlay', 'diagnostic', issue.code, issue.targetId ?? 'document']),
				center: point,
				radiusPx: 6,
				style: 'layout-diagnostic'
			});
		}
	}

	let roomLabelReadout: RoomLabelReadout | undefined;
	// P23.13 S3 — persistent Room labels are a free-space layout problem (spec
	// §4), not a point anchor: `placeRoomLabels` derives large free-space
	// candidates from the projected Room polygon minus an eligibility mask,
	// tests the *complete* text rectangle (concave-aware), reduces tiers in the
	// ratified drop order and keeps the accepted candidate sticky. This
	// projection supplies only the canonical inputs — compiled floor polygons,
	// resolved display identity, derived area — plus the mask, and never invents
	// geometry, identity or area.
	{
		// §5 still owns the global vocabulary floor: below it no resting Room label
		// exists at all (read from the one S2 gate table, never a second copy).
		if (interaction.planView.pixelsPerMeter >= ROOM_LABEL_MIN_PX_PER_M) {
			const legacyNames = new Map(rooms.map((room) => [room.id, room.name] as const));
			const labelContext = wallFirst?.roomLabels;
			const facts: RoomLabelFacts[] = [];
			for (const room of model.rooms) {
				if (room.floorPolygon.length < 3) continue;
				const identity = labelContext?.facts.get(room.roomId);
				facts.push({
					roomId: room.roomId,
					polygon: room.floorPolygon,
					// D2 tier order: authored name → compact reference → raw-ID label.
					name:
						identity?.name ??
						wallFirst?.roomNames.get(room.roomId) ??
						legacyNames.get(room.roomId) ??
						room.roomId,
					reference: identity?.reference ?? null,
					// Compiled floor polygon is the canonical area source (§4).
					areaM2: identity?.areaM2 ?? roomFloorAreaM2(room.floorPolygon)
				});
			}
			const placement = placeRoomLabels({
				rooms: facts,
				planView: interaction.planView,
				measure: labelContext?.measure,
				mask: buildRoomLabelMask(model, interaction, selection, handles, drafts, labels),
				selectedRoomId:
					interaction.tool === 'select' && interaction.selection.kind === 'room'
						? interaction.selection.roomId
						: null,
				reason: labelContext?.reason,
				settleGeneration: labelContext?.settleGeneration,
				tierDropZone: labelContext?.tierDropZone,
				memory: labelContext?.memory
			});
			for (const placed of placement.labels) {
				for (const [index, line] of placed.lines.entries()) {
					labels.push({
						kind: 'text',
						key:
							index === 0
								? geometryId(['plan', 'overlay', 'room-name', placed.roomId])
								: geometryId(['plan', 'overlay', 'room-label', line.style, placed.roomId, String(index)]),
						anchor: placed.anchorWorld,
						text: line.text,
						// Screen-constant stacked lines: the placer's baselines are already
						// relative to the shared anchor.
						offsetPx: [0, line.baselineOffsetPx],
						style: line.style
					});
				}
			}
			roomLabelReadout = placement.readout ?? undefined;
		}
	}

	// P23.13 S6 — the working dimension set (spec §7), derived from the live
	// gesture and placed last so its witnesses and text read over the preview
	// scaffolding they measure. An empty readout is omitted rather than sent as
	// an empty list, so "no measure had to move" and "the host says nothing" are
	// the same absence everywhere downstream.
	const dimensions = pushPlanDimensions(
		interaction,
		model,
		wallFirst?.dimensions,
		drafts,
		labels
	);

	return {
		selected: toPlanSelection(interaction.selection),
		hovered,
		selection,
		handles,
		drafts,
		labels,
		roomOverrides,
		objectOverrides,
		...(roomLabelReadout ? { roomLabelReadout } : {}),
		...(dimensions.readout.length > 0 ? { measureReadout: dimensions.readout } : {})
	};
}

/**
 * P23.13 S3 — the Room label eligibility mask. Only the mask is affected:
 * eligible area loses core wall/opening bands (8 px beyond the authored band
 * half-thickness), authored object footprints, active annotation/control bounds
 * (12 px) and active text (24 px). Geometry, Room boundaries and topology are
 * untouched, and *unselected* passive Scene never blocks text — it yields.
 */
function buildRoomLabelMask(
	model: LayoutPreviewModel,
	interaction: LayoutInteractionState,
	selection: readonly PlanRenderPrimitive[],
	handles: readonly PlanRenderPrimitive[],
	drafts: readonly PlanRenderPrimitive[],
	labels: readonly PlanRenderPrimitive[]
): RoomLabelMask {
	const pixelsPerMeter = Math.max(interaction.planView.pixelsPerMeter, 1e-6);
	const protectedEdges: RoomLabelProtectedEdge[] = [];
	for (const room of model.rooms) {
		for (const wall of room.walls) {
			const clearancePx = (wall.thickness / 2) * pixelsPerMeter + ROOM_LABEL_CORE_GEOMETRY_RESERVE_PX;
			for (const polyline of wall.solidCenterlinePolylines) {
				if (polyline.length > 1) protectedEdges.push({ points: polyline, clearancePx });
			}
		}
	}
	const obstacles: RoomLabelObstacle[] = [];
	for (const object of model.objects) {
		if (object.planFootprint.length < 3) continue;
		obstacles.push({
			polygon: object.planFootprint,
			clearancePx: ROOM_LABEL_CORE_GEOMETRY_RESERVE_PX
		});
	}
	const acquisitionZones: RoomLabelAcquisitionZone[] = [];
	for (const primitive of [...selection, ...drafts]) {
		if (primitive.kind === 'circle') {
			acquisitionZones.push({
				center: primitive.center,
				radiusPx: primitive.radiusPx,
				clearancePx: ROOM_LABEL_ACQUISITION_RESERVE_PX
			});
			continue;
		}
		if (primitive.kind === 'polygon' && primitive.points.length >= 3) {
			if (primitive.style === 'selection-bounds') {
				// The selected Room's own outline traces geometry: it reserves a band,
				// never its interior — filling it would forbid the very face the label
				// belongs to. A selected Room therefore uses the same placer and mask
				// classes as any other, with no centroid override and no tier bias.
				protectedEdges.push({
					points: [...primitive.points, primitive.points[0]!],
					clearancePx: ROOM_LABEL_ACQUISITION_RESERVE_PX
				});
				continue;
			}
			// A region annotation (draft outline, transient intent, ghost footprint):
			// text inside it would sit on a live control, so the region is reserved.
			obstacles.push({
				polygon: primitive.points,
				clearancePx: ROOM_LABEL_ACQUISITION_RESERVE_PX
			});
			continue;
		}
		if (primitive.kind === 'polyline' && primitive.points.length > 1) {
			// An outline that traces geometry (e.g. a selected Room's own boundary,
			// a closure/moat path) reserves a band, not its interior: filling it
			// would forbid the very face the label belongs to.
			protectedEdges.push({
				points: primitive.points,
				clearancePx: ROOM_LABEL_ACQUISITION_RESERVE_PX
			});
		}
	}
	for (const primitive of handles) {
		if (primitive.kind !== 'circle') continue;
		acquisitionZones.push({
			center: primitive.center,
			radiusPx: primitive.radiusPx,
			clearancePx: ROOM_LABEL_ACQUISITION_RESERVE_PX
		});
	}
	// Active text (dimensions, transform feedback, selected-target readouts) is
	// reserved at 24 px. Non-Room text roles are measured with the nearest role's
	// metrics — a readability apron, never a claim about that text's exact box.
	const activeText: RoomLabelActiveText[] = [];
	for (const primitive of labels) {
		if (primitive.kind !== 'text') continue;
		// An editable value is the same ink as any other dimension: the placer must
		// measure it with the dimension typography, not with the Room name's, or the
		// collision math would be computed against the wrong text box.
		const role =
			primitive.style === 'dimension-label'
				? 'room-reference'
				: 'room-name';
		const extent = APPROXIMATE_TEXT_MEASURE(primitive.text, role);
		const screen = worldToPlanScreen(interaction.planView, primitive.anchor);
		const offset = primitive.offsetPx ?? [0, 0];
		const anchorX = screen[0] + offset[0];
		const anchorY = screen[1] + offset[1];
		activeText.push({
			rect: {
				minX: anchorX - extent.width / 2,
				minY: anchorY - extent.height,
				maxX: anchorX + extent.width / 2,
				maxY: anchorY
			},
			clearancePx: ROOM_LABEL_ACTIVE_TEXT_RESERVE_PX
		});
	}	return { protectedEdges, obstacles, acquisitionZones, activeText };
}

/**
 * P23.6 — resolve a diagnostic target to a Plan point: Walls (and hosted
 * Openings via their Wall) read the canonical span midpoint, Rooms read
 * their floor centroid. `undefined` when the target is absent or unmapped.
 */
function diagnosticPoint(
	model: LayoutPreviewModel,
	targetId: string | undefined
): LayoutVec2 | null {
	if (!targetId) return null;
	let wallId = targetId;
	const openingSpan = model.queries.spans.find(
		(span) => span.kind === 'opening' && span.openingId === targetId
	);
	if (openingSpan) wallId = openingSpan.wallKey ?? openingSpan.segmentId;
	const span = physicalWallSpan(model, wallId);
	if (span) return [(span.start[0] + span.end[0]) / 2, (span.start[1] + span.end[1]) / 2];
	const room = model.rooms.find((candidate) => candidate.roomId === targetId);
	if (room && room.floorPolygon.length > 0) {
		let x = 0;
		let z = 0;
		for (const point of room.floorPolygon) {
			x += point[0];
			z += point[1];
		}
		return [x / room.floorPolygon.length, z / room.floorPolygon.length];
	}
	return null;
}

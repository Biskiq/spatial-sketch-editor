import type { LayoutRoom, LayoutVec2 } from '$lib/layout/layout-types';
import { LAYOUT_PLAN_SNAP_RADIUS_CSS_PX, pointStrictlyInsidePolygon } from '@portfolio/layout-core';
import type { LayoutPreviewModel } from './layout-mesh-factory';
import {
	primitiveDraftFootprint,
	rectanglePoints,
	wallChainRoleForTool,
	type LayoutArchitectureEditGesture,
	type LayoutInteractionState,
	type LayoutSelection
} from './layout-interaction';
import { worldToPlanScreen, type PlanViewportState } from './layout-plan-transform';
import { geometryId } from '$lib/layout/layout-geometry-types';
import { layoutArchitecturalPreset } from '$lib/layout/layout-wall-first-precision';
import { isLayoutPresetTool, type LayoutPresetTool } from './layout-interaction';
import type { LayoutArchitecturalPresetId, SnapResolution } from '@portfolio/layout-core';
import type { PlanCurveControlCandidate } from './plan-hit';
import type {
	PlanHitIdentity,
	PlanInteractionProjection,
	PlanRenderPrimitive,
	PlanSelection,
	PlanStyleToken
} from '$lib/layout/plan-render-model';

/**
 * Transient interaction overlays, derived editor-side into world-space
 * `PlanRenderPrimitive` records. Screen-constant sizing/offsets are carried as
 * px hints (`radiusPx`/`offsetPx`) for the SVG adapter to apply after the view
 * transform. No Svelte/DOM imports; the viewport forwards interaction state
 * into this projection instead of computing overlay screen coordinates.
 */

const SNAP_MARKER_RADIUS_PX = 4;
const ROTATION_HANDLE_OFFSET_PX = 28;
const ROTATION_FEEDBACK_OFFSET_PX = 40;
const DIMENSION_LABEL_OFFSET_PX = 5;

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
	/** Resolved run-start Junction point for the closure cue (`null` when none). */
	runStartPoint: LayoutVec2 | null;
	/** Committed compiler issues with positioned targets for diagnostic markers. */
	issues: readonly { code: string; message: string; targetId?: string; path?: string }[];
};

/**
 * P23.6 — guaranteed-interior Room label anchor. The area centroid is exact
 * for convex faces; on concave faces it can land in a notch/outside, so fall
 * back to the largest ear-triangle centroid (ear clipping over the simple
 * polygon — always strictly inside the face). Deterministic: ties keep the
 * lowest vertex order. Never a general annotation solver.
 */
export function interiorLabelPoint(polygon: readonly LayoutVec2[]): LayoutVec2 {
	const mean: LayoutVec2 = [
		polygon.reduce((sum, point) => sum + point[0], 0) / polygon.length,
		polygon.reduce((sum, point) => sum + point[1], 0) / polygon.length
	];
	let twiceArea = 0;
	let cx = 0;
	let cz = 0;
	for (let index = 0; index < polygon.length; index += 1) {
		const current = polygon[index]!;
		const next = polygon[(index + 1) % polygon.length]!;
		const cross = current[0] * next[1] - next[0] * current[1];
		twiceArea += cross;
		cx += (current[0] + next[0]) * cross;
		cz += (current[1] + next[1]) * cross;
	}
	const centroid: LayoutVec2 =
		Math.abs(twiceArea) > 1e-12
			? [cx / (3 * twiceArea), cz / (3 * twiceArea)]
			: mean;
	if (pointStrictlyInsidePolygon(polygon, centroid)) return centroid;
	// Concave face with an exterior centroid: largest ear wins.
	const orient = twiceArea >= 0 ? 1 : -1;
	const remaining = polygon.map((_, index) => index);
	let best: { area: number; point: LayoutVec2 } | null = null;
	const triArea2 = (a: LayoutVec2, b: LayoutVec2, c: LayoutVec2): number =>
		(b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
	const triCentroid = (a: LayoutVec2, b: LayoutVec2, c: LayoutVec2): LayoutVec2 => [
		(a[0] + b[0] + c[0]) / 3,
		(a[1] + b[1] + c[1]) / 3
	];
	for (let guard = 0; guard < polygon.length * polygon.length && remaining.length > 3; guard += 1) {
		let clipAt = -1;
		let clipArea = Number.POSITIVE_INFINITY;
		for (let slot = 0; slot < remaining.length; slot += 1) {
			const a = polygon[remaining[(slot + remaining.length - 1) % remaining.length]!]!;
			const b = polygon[remaining[slot]!]!;
			const c = polygon[remaining[(slot + 1) % remaining.length]!]!;
			// Convex under the face orientation?
			if (triArea2(a, b, c) * orient <= 0) continue;
			// Ear: no other vertex strictly inside the candidate triangle.
			let blocked = false;
			for (const other of remaining) {
				const p = polygon[other]!;
				if (p === a || p === b || p === c) continue;
				const s1 = triArea2(a, b, p) * orient;
				const s2 = triArea2(b, c, p) * orient;
				const s3 = triArea2(c, a, p) * orient;
				if (s1 > 0 && s2 > 0 && s3 > 0) {
					blocked = true;
					break;
				}
			}
			if (blocked) continue;
			const area = Math.abs(triArea2(a, b, c)) / 2;
			if (!best || area > best.area) best = { area, point: triCentroid(a, b, c) };
			if (area < clipArea) {
				clipArea = area;
				clipAt = slot;
			}
		}
		if (clipAt < 0) break;
		remaining.splice(clipAt, 1);
	}
	if (remaining.length === 3) {
		const [a, b, c] = remaining.map((index) => polygon[index]!) as [LayoutVec2, LayoutVec2, LayoutVec2];
		const area = Math.abs(triArea2(a, b, c)) / 2;
		if (!best || area > best.area) best = { area, point: triCentroid(a, b, c) };
	}
	return best?.point ?? mean;
}

/** P23.6 — snap marker radius per winning family (screen-constant, zoom-stable). */
export function snapMarkerRadiusPx(kind: string): number {
	switch (kind) {
		case 'junction':
		case 'wall-intersection':
			return 5;
		case 'grid':
			return 3;
		default:
			return SNAP_MARKER_RADIUS_PX;
	}
}

/** P23.6 — legibility floors for persistent Room name labels. */
export const ROOM_LABEL_MIN_AREA_M2 = 1;
export const ROOM_LABEL_MIN_PX_PER_M = 6;
/** P23.6 — Junction handles hide below this Plan scale (mirrors grid-minor culling). */
export const JUNCTION_HANDLES_MIN_PX_PER_M = 6;
/**
 * P23.6 — label suppression radius in screen px. A Room-name candidate whose
 * anchor falls inside this radius of a higher-priority label/marker (or an
 * already accepted Room label) is hidden. Screen-constant so the density
 * rule is zoom-stable; document order wins ties deterministically.
 */
export const ROOM_LABEL_SUPPRESSION_RADIUS_PX = 24;

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
	handles: PlanRenderPrimitive[],
	labels: PlanRenderPrimitive[]
): void {
	const edges = wallOpeningEdgeWorldPoints(model, selection.openingId);
	if (!edges) return;
	handles.push(
		{
			kind: 'circle',
			key: geometryId(['plan', 'overlay', 'opening-handle', selection.openingId, 'start']),
			center: edges.start,
			radiusPx: 6,
			style: 'opening-handle'
		},
		{
			kind: 'circle',
			key: geometryId(['plan', 'overlay', 'opening-handle', selection.openingId, 'end']),
			center: edges.end,
			radiusPx: 6,
			style: 'opening-handle'
		}
	);
	labels.push({
		kind: 'text',
		key: geometryId(['plan', 'overlay', 'opening-handle-label', selection.openingId]),
		anchor: [(edges.start[0] + edges.end[0]) / 2, (edges.start[1] + edges.end[1]) / 2],
		text: `${Math.hypot(edges.end[0] - edges.start[0], edges.end[1] - edges.start[1]).toFixed(2)} m`,
		offsetPx: [0, -DIMENSION_LABEL_OFFSET_PX],
		style: 'dimension-label'
	});
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
	labels.push({
		kind: 'text',
		key: geometryId(['plan', 'overlay', 'opening-drag-label']),
		anchor: pointAtWallOffset(span, drag.candidateOffset + width / 2),
		text: `${drag.candidateOffset.toFixed(2)} m`,
		offsetPx: [0, -DIMENSION_LABEL_OFFSET_PX],
		style: 'dimension-label'
	});
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
	 * P23.11 — a rejected curve-control drag. The baseline stays installed; the
	 * attempted Wall is drawn from the caller's canonical **proposal** (never a
	 * fabricated curve), with the rejected control point marked on it.
	 */
	| {
			kind: 'curve-control-move';
			point: LayoutVec2;
			shape?: readonly LayoutVec2[];
			walls?: readonly LayoutArchitectureEditOverlayWall[];
	  }
	/**
	 * P23.11 — a rejected Bend-command drag. Same contract: the transient layer
	 * renders the proposal's attempted Wall shape and the refused bend point, so
	 * the geometry keeps following the cursor instead of snapping back while the
	 * pointer is still held.
	 */
	| {
			kind: 'wall-bend';
			point: LayoutVec2;
			shape?: readonly LayoutVec2[];
			walls?: readonly LayoutArchitectureEditOverlayWall[];
	  };

/**
 * The attempt plus its render style.
 *
 * `invalid` is **only** for an attempt that could not be derived at all, which
 * is the sole refused fact a pointermove can honestly know: whether the
 * canonical planner will accept the geometry is decided exactly once, at
 * release, by the planner that owns validation. A derivable live attempt is
 * therefore PENDING and renders in the transient attempt language; a released
 * refusal is reported by the release path (status message plus an exact
 * baseline), not by a red preview the user cannot act on.
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
	 * P23.11 transient pass — `true` only when the attempt could not be derived
	 * at all (the core proposal returned nothing), so nothing but a refused
	 * point marker can be drawn. It is NOT a validity verdict: those belong to
	 * the canonical planner at release.
	 */
	attemptRefused = false
): LayoutArchitectureEditIntent | null {
	if (!gesture || !moved) return null;
	const refused = attemptRefused ? ({ invalid: true } as const) : {};
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
	return { ...projection, drafts: [...projection.drafts, ...primitives] };
}

/**
 * P23.2 — transient snap feedback as render primitives. Session state only:
 * the resolution is recomputed per pointer event and never mutates the
 * document or history. Guides render as thin dashed screen-space lines; the
 * marker shows the resolved point, muted for the grid fallback so semantic
 * candidates are visually distinct.
 */
export function withLayoutSnapFeedback(
	projection: PlanInteractionProjection,
	resolution: SnapResolution | null
): PlanInteractionProjection {
	if (!resolution || resolution.kind !== 'snap') return projection;
	const { candidate, guides } = resolution;
	const primitives: PlanRenderPrimitive[] = guides.map((guide, index) => ({
		kind: 'polyline',
		key: geometryId(['plan', 'snap-feedback', 'guide', candidate.sourceId, String(index)]),
		points: [guide.start, guide.end],
		style: 'snap-guide'
	}));
	primitives.push({
		kind: 'circle',
		key: geometryId(['plan', 'snap-feedback', 'marker', candidate.sourceId]),
		center: candidate.point,
		radiusPx: snapMarkerRadiusPx(candidate.kind),
		style: candidate.kind === 'grid' ? 'snap-marker-grid' : 'snap-marker'
	});
	return { ...projection, drafts: [...projection.drafts, ...primitives] };
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
		const topCenter = roomTopCenter(model, selectedRoom.id);
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
		for (let edgeIndex = 0; edgeIndex < points.length; edgeIndex += 1) {
			const start = points[edgeIndex]!;
			const end = points[(edgeIndex + 1) % points.length]!;
			const edgeLength = model.rooms.find((room) => room.roomId === selectedRoom.id)?.walls[edgeIndex]?.length;
			const text = edgeLength === undefined
				? Math.hypot(end[0] - start[0], end[1] - start[1]).toFixed(2)
				: edgeLength.toFixed(2);
			labels.push({
				kind: 'text',
				key: geometryId(['plan', 'overlay', 'dimension-label', selectedRoom.id, String(edgeIndex)]),
				anchor: [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2],
				text: `${text} m`,
				offsetPx: [0, -DIMENSION_LABEL_OFFSET_PX],
				style: 'dimension-label'
			});
		}
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
		if (chainLeg && !degenerate) {
			const midpoint: LayoutVec2 = [
				(chainLeg.start[0] + chainLeg.cursor[0]) / 2,
				(chainLeg.start[1] + chainLeg.cursor[1]) / 2
			];
			labels.push({
				kind: 'text',
				key: geometryId(['plan', 'overlay', 'candidate-length']),
				anchor: midpoint,
				text: closing ? `Close · ${chainLeg.length.toFixed(2)} m` : `${chainLeg.length.toFixed(2)} m`,
				offsetPx: [0, -DIMENSION_LABEL_OFFSET_PX],
				style: 'dimension-label'
			});
			if (closing && wallFirst?.runStartPoint) {
				drafts.push({
					kind: 'circle',
					key: geometryId(['plan', 'overlay', 'closure-cue']),
					center: [...wallFirst.runStartPoint] as LayoutVec2,
					radiusPx: 6,
					style: 'snap-marker'
				});
			}
		}
	}

	// P23.3 — canonical Opening affordances + transient drag preview. Both are
	// session-only projections: no document write ever happens during a drag.
	if (activeSelection.kind === 'wallOpening') {
		pushWallOpeningAffordances(activeSelection, model, handles, labels);
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
					radiusPx: 5,
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
					radiusPx: 5,
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

	// P23.6 — committed topology/geometry diagnostics as Plan markers (state,
	// not transient preview). Positioned from the affected source Wall/Room;
	// the concise reason lives in the Inspector topology section. Issues
	// without a resolvable target keep their count only — never a guess.
	// Markers land before Room labels so diagnostics outrank names.
	const diagnosticPoints: LayoutVec2[] = [];
	if (wallFirst) {
		for (const issue of wallFirst.issues) {
			const point = diagnosticPoint(model, issue.targetId);
			if (!point) continue;
			diagnosticPoints.push(point);
			handles.push({
				kind: 'circle',
				key: geometryId(['plan', 'overlay', 'diagnostic', issue.code, issue.targetId ?? 'document']),
				center: point,
				radiusPx: 6,
				style: 'layout-diagnostic'
			});
		}
	}

	// P23.6 — persistent Room names as presentation-only labels (never
	// separately persisted annotations). Bounded density, lowest priority:
	// legible face area + Plan scale floor, a guaranteed-interior anchor, and
	// deterministic suppression inside the screen-constant radius of any
	// higher-priority label/marker (dimensions, selection feedback,
	// diagnostics) or already accepted Room label — document order wins.
	{
		const legacyNames = new Map(rooms.map((room) => [room.id, room.name] as const));
		const pixelsPerMeter = Math.max(interaction.planView.pixelsPerMeter, 1e-6);
		const suppressionRadius = ROOM_LABEL_SUPPRESSION_RADIUS_PX / pixelsPerMeter;
		const blockers: LayoutVec2[] = [...diagnosticPoints];
		for (const primitive of labels) {
			if (primitive.kind === 'text' && primitive.style !== 'room-name') blockers.push(primitive.anchor);
		}
		for (const primitive of [...selection, ...handles, ...drafts]) {
			if (primitive.kind === 'circle') blockers.push(primitive.center);
		}
		for (const room of model.rooms) {
			const name = wallFirst?.roomNames.get(room.roomId) ?? legacyNames.get(room.roomId) ?? room.roomId;
			const polygon = room.floorPolygon;
			if (polygon.length < 3) continue;
			let twiceArea = 0;
			for (let index = 0; index < polygon.length; index += 1) {
				const current = polygon[index]!;
				const next = polygon[(index + 1) % polygon.length]!;
				twiceArea += current[0] * next[1] - next[0] * current[1];
			}
			if (Math.abs(twiceArea) / 2 < ROOM_LABEL_MIN_AREA_M2) continue;
			if (interaction.planView.pixelsPerMeter < ROOM_LABEL_MIN_PX_PER_M) continue;
			const anchor = interiorLabelPoint(polygon);
			if (
				blockers.some(
					(blocked) => Math.hypot(blocked[0] - anchor[0], blocked[1] - anchor[1]) <= suppressionRadius
				)
			) {
				continue;
			}
			blockers.push(anchor);
			labels.push({
				kind: 'text',
				key: geometryId(['plan', 'overlay', 'room-name', room.roomId]),
				anchor,
				text: name,
				style: 'room-name'
			});
		}
	}

	return { selected: toPlanSelection(interaction.selection), hovered, selection, handles, drafts, labels, roomOverrides, objectOverrides };
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
